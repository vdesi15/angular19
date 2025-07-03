// components/search-bar/search-bar.component.ts
import { Component, EventEmitter, Output, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Modules
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { SearchQueryDetectionService, QueryDetectionResult } from '../services/search-query-detection.service';
import { FavoritesPopoverComponent } from 'src/app/core/components/search-favorites/search-favorites.component';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    TooltipModule,
    FavoritesPopoverComponent
  ]
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();
  
  // New input signal for controlling initial position
  public initialPosition = input<'center' | 'top'>('center');
  
  // View child for search input
  private searchInput = viewChild.required<ElementRef>('searchInput');
  
  // Service injections
  private strategyManager = inject(SearchStrategyManager);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private searchFilterService = inject(SearchFilterService);
  private route = inject(ActivatedRoute);

  // ================================
  // REACTIVE STATE SIGNALS
  // ================================

  public searchQuery: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);
  public showExamples: WritableSignal<boolean> = signal(false);
  
  // Search bar state management
  public searchBarState: WritableSignal<SearchBarState> = signal({
    position: 'center',
    hasResults: false,
    isSearching: false
  });

  // ================================
  // COMPUTED SIGNALS
  // ================================

  public detectedStrategy = computed(() => {
    const query = this.searchQuery().trim();
    if (!query) return null;
    
    const strategy = this.strategyManager.selectBestStrategy(query);
    if (!strategy) return null;
    
    const testResults = this.strategyManager.testStrategiesForQuery(query);
    const bestMatch = testResults.find(r => r.canHandle);
    
    return {
      type: bestMatch?.strategy || 'unknown',
      strategy: strategy,
      confidence: bestMatch ? 0.9 : 0.5, // Simplified confidence
      name: bestMatch?.name || 'Unknown'
    };
  });

  public canSearch = computed(() => {
    const query = this.searchQuery().trim();
    return query.length > 0 && !this.isSearching();
  });

  public currentPlaceholder = computed(() => {
    const state = this.searchBarState();
    
    if (state.position === 'top') {
      return 'Search transactions, JIRA tickets, batches...';
    }
    
    const detectedStrategy = this.detectedStrategy();
    if (detectedStrategy) {
      return this.getPlaceholderForStrategy(detectedStrategy.type);
    }
    
    return 'Enter transaction ID, JIRA ticket, or search term...';
  });

  public searchStats = computed(() => {
    const activeSearches = this.searchOrchestrator.activeSearches();
    const strategyStats = this.strategyManager.getStrategyStats();
    
    return {
      activeSearches: activeSearches.length,
      lastStrategy: strategyStats.lastUsed,
      totalStrategies: strategyStats.total
    };
  });

  // ================================
  // SEARCH EXAMPLES DATA
  // ================================

  public readonly searchExamples = [
    {
      type: 'transaction',
      label: 'Transaction ID',
      query: '550e8400-e29b-41d4-a716-446655440000',
      icon: 'pi pi-receipt'
    },
    {
      type: 'jira',
      label: 'JIRA Ticket',
      query: 'PROJ-123',
      icon: 'pi pi-ticket'
    },
    {
      type: 'batch',
      label: 'Batch ID',
      query: 'BATCH001',
      icon: 'pi pi-th-large'
    },
    {
      type: 'natural',
      label: 'Natural Search',
      query: 'payment errors last hour',
      icon: 'pi pi-comments'
    }
  ];

  // ================================
  // LIFECYCLE & EFFECTS
  // ================================

  constructor() {
    // Effect to handle search bar positioning based on results
    effect(() => {
      const activeSearches = this.searchOrchestrator.activeSearches();
      const hasResults = activeSearches.length > 0;
      const currentState = this.searchBarState();
      
      // Auto-transition to top when results appear
      if (hasResults && currentState.position === 'center') {
        this.searchBarState.set({
          ...currentState,
          position: 'top',
          hasResults: true
        });
      }
      
      // Return to center when no results (optional)
      // Uncomment if you want automatic return to center
      // else if (!hasResults && currentState.position === 'top') {
      //   this.searchBarState.set({
      //     ...currentState,
      //     position: 'center',
      //     hasResults: false
      //   });
      // }
    });

    // Effect to sync searching state
    effect(() => {
      const orchestratorSearching = this.searchOrchestrator.activeSearches()
        .some(search => search.isLoading);
      
      this.searchBarState.update(state => ({
        ...state,
        isSearching: orchestratorSearching
      }));
    });
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  public async handleSearch(): Promise<void> {
    const query = this.searchQuery().trim();
    if (!query || this.isSearching()) return;

    this.isSearching.set(true);
    this.showExamples.set(false);

    try {
      // Use strategy manager's enhanced request processing
      const searchRequest = {
        type: 'transaction' as const, // Will be auto-detected
        query,
        title: '',
        appName: ''
      };

      const enhancedRequest = this.strategyManager.enhanceRequest(searchRequest);
      
      // Emit the search event
      this.search.emit(query);
      
      // Execute the search through orchestrator
      await this.searchOrchestrator.performSearch(enhancedRequest);
      
    } catch (error) {
      console.error('[SearchBar] Search failed:', error);
    } finally {
      this.isSearching.set(false);
    }
  }

  public onQueryChange(): void {
    const query = this.searchQuery();
    
    // Show examples for empty queries in center mode
    if (!query && this.searchBarState().position === 'center') {
      this.showExamples.set(true);
    } else {
      this.showExamples.set(false);
    }
  }

  public useExample(exampleQuery: string): void {
    this.searchQuery.set(exampleQuery);
    this.showExamples.set(false);
    
    // Focus input and trigger search
    setTimeout(() => {
      this.searchInput().nativeElement.focus();
    }, 100);
  }

  // ================================
  // UI HELPER METHODS
  // ================================

  public getStrategyIndicatorClass(confidence: number): string {
    const baseClass = 'strategy-indicator';
    
    if (confidence >= 0.8) return `${baseClass} high-confidence`;
    if (confidence >= 0.6) return `${baseClass} medium-confidence`;
    return `${baseClass} low-confidence`;
  }

  public getStrategyIcon(strategyType: string): string {
    const iconMap: Record<string, string> = {
      'transaction': 'pi pi-receipt',
      'jira': 'pi pi-ticket',
      'batch': 'pi pi-th-large',
      'natural': 'pi pi-comments',
      'browse': 'pi pi-list',
      'error': 'pi pi-exclamation-triangle'
    };
    
    return iconMap[strategyType] || 'pi pi-search';
  }

  public getStrategyLabel(strategyType: string): string {
    const labelMap: Record<string, string> = {
      'transaction': 'Transaction',
      'jira': 'JIRA Ticket',
      'batch': 'Batch Process',
      'natural': 'Smart Search',
      'browse': 'Browse',
      'error': 'Error Stream'
    };
    
    return labelMap[strategyType] || 'Search';
  }

  private getPlaceholderForStrategy(strategyType: string): string {
    const placeholderMap: Record<string, string> = {
      'transaction': 'Transaction ID detected - press Enter to search',
      'jira': 'JIRA ticket detected - press Enter to search',
      'batch': 'Batch ID detected - press Enter to search',
      'natural': 'Natural language query - press Enter to search',
      'browse': 'Browse mode active',
      'error': 'Error stream mode active'
    };
    
    return placeholderMap[strategyType] || 'Press Enter to search';
  }

  // ================================
  // PUBLIC API METHODS
  // ================================

  /**
   * Programmatically set search bar position
   */
  public setPosition(position: 'center' | 'top'): void {
    this.searchBarState.update(state => ({
      ...state,
      position
    }));
  }

  /**
   * Clear search and reset position
   */
  public clearSearch(): void {
    this.searchQuery.set('');
    this.searchBarState.set({
      position: 'center',
      hasResults: false,
      isSearching: false
    });
  }

  /**
   * Focus the search input
   */
  public focusInput(): void {
    this.searchInput().nativeElement.focus();
  }
}