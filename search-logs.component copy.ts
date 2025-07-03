// src/app/features/search-logs/components/search-logs.component.ts
// ================================
// MODERNIZED SEARCH LOGS - Angular 19 with Dynamic Layout
// ================================

import { 
  Component, 
  inject, 
  signal, 
  computed, 
  effect,
  viewChild,
  WritableSignal 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

// PrimeNG Modules (v19 compatible)
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DividerModule } from 'primeng/divider';

// Components
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SearchResultComponent } from './search-result/search-result.component';

// Services
import { SearchOrchestratorService } from '../services/search-orchestrator.service';
import { SearchStrategyManager } from '../services/search-strategy.manager';

interface PageState {
  mode: 'search' | 'browse' | 'error';
  hasActiveSearches: boolean;
  isInitialLoad: boolean;
  showEmptyState: boolean;
}

@Component({
  selector: 'app-search-logs',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ChipModule,
    ProgressSpinnerModule,
    DividerModule,
    SearchBarComponent,
    SearchResultComponent
  ],
  template: `
    <div class="search-logs-container" [class]="getContainerClass()">
      
      <!-- Dynamic Search Bar - Position changes based on results -->
      <div class="search-bar-section" 
           [class.search-bar-centered]="!pageState().hasActiveSearches"
           [class.search-bar-header]="pageState().hasActiveSearches">
        
        @if (pageState().mode === 'search') {
          <!-- Search Mode Header (when centered) -->
          @if (!pageState().hasActiveSearches) {
            <div class="search-page-header">
              <div class="header-content">
                <h1 class="page-title">
                  <i class="pi pi-search"></i>
                  <span>Intelligent Search</span>
                </h1>
                <p class="page-description">
                  Search transactions, JIRA tickets, batch processes, and more with our smart detection system
                </p>
              </div>
              
              <!-- Strategy Stats -->
              @if (strategyStats(); as stats) {
                <div class="strategy-info">
                  <p-chip 
                    [label]="stats.total + ' strategies available'" 
                    icon="pi pi-cog"
                    styleClass="stats-chip">
                  </p-chip>
                  @if (stats.lastUsed) {
                    <p-chip 
                      [label]="'Last used: ' + stats.lastUsed" 
                      styleClass="last-used-chip">
                    </p-chip>
                  }
                </div>
              }
            </div>
          }
        }
        
        <!-- Search Bar Component -->
        <app-search-bar 
          #searchBar
          (search)="handleSearch($event)"
          [initialPosition]="pageState().hasActiveSearches ? 'top' : 'center'">
        </app-search-bar>
        
        <!-- Quick Actions (when in header mode) -->
        @if (pageState().hasActiveSearches) {
          <div class="quick-actions">
            <button 
              pButton 
              type="button"
              icon="pi pi-refresh"
              severity="secondary"
              size="small"
              (click)="refreshActiveSearches()"
              pTooltip="Refresh all searches"
              [disabled]="isRefreshing()">
            </button>
            
            <button 
              pButton 
              type="button"
              icon="pi pi-times"
              severity="secondary"
              size="small"
              (click)="clearAllSearches()"
              pTooltip="Clear all searches"
              [disabled]="activeSearches().length === 0">
            </button>
          </div>
        }
      </div>

      <!-- Results Section -->
      <div class="results-section" [class.results-fullscreen]="pageState().hasActiveSearches">
        
        <!-- Active Search Results -->
        @if (activeSearches().length > 0) {
          <div class="active-searches">
            @for (search of activeSearches(); track search.id) {
              <app-search-result 
                [search]="search"
                [class.result-card]="true">
              </app-search-result>
            }
          </div>
        }
        
        <!-- Empty States -->
        @else {
          @switch (pageState().mode) {
            
            <!-- Search Mode Empty State -->
            @case ('search') {
              <div class="empty-state search-empty">
                <div class="empty-content">
                  <i class="pi pi-search empty-icon"></i>
                  <h3>Ready to Search</h3>
                  <p>Enter a transaction ID, JIRA ticket, batch ID, or use natural language to get started</p>
                  
                  <!-- Search Examples -->
                  <div class="search-examples">
                    <h4>Try these examples:</h4>
                    <div class="examples-grid">
                      @for (example of searchExamples; track example.type) {
                        <button 
                          pButton 
                          type="button"
                          [label]="example.label"
                          [icon]="example.icon"
                          severity="secondary"
                          size="small"
                          (click)="searchExample(example.query)"
                          class="example-btn">
                          <small>{{ example.query }}</small>
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
            
            <!-- Browse Mode Empty State -->
            @case ('browse') {
              <div class="empty-state browse-empty">
                <div class="empty-content">
                  <i class="pi pi-list empty-icon loading"></i>
                  <h3>Loading Browse Data</h3>
                  <p>Connecting to live data stream...</p>
                  <p-progressSpinner [style]="{ width: '2rem', height: '2rem' }"></p-progressSpinner>
                </div>
              </div>
            }
            
            <!-- Error Mode Empty State -->
            @case ('error') {
              <div class="empty-state error-empty">
                <div class="empty-content">
                  <i class="pi pi-exclamation-triangle empty-icon error"></i>
                  <h3>Loading Error Stream</h3>
                  <p>Connecting to error monitoring...</p>
                  <p-progressSpinner [style]="{ width: '2rem', height: '2rem' }"></p-progressSpinner>
                </div>
              </div>
            }
          }
        }
      </div>
      
      <!-- Loading Overlay -->
      @if (isLoading()) {
        <div class="loading-overlay">
          <div class="loading-content">
            <p-progressSpinner></p-progressSpinner>
            <span>{{ loadingMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./search-logs.component.scss']
})
export class SearchLogsComponent {
  
  // ================================
  // ANGULAR 19 SIGNALS & SERVICES
  // ================================
  
  private route = inject(ActivatedRoute);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private strategyManager = inject(SearchStrategyManager);
  
  // View child references
  private searchBar = viewChild<SearchBarComponent>('searchBar');
  
  // ================================
  // REACTIVE STATE SIGNALS
  // ================================
  
  public pageState: WritableSignal<PageState> = signal({
    mode: 'search',
    hasActiveSearches: false,
    isInitialLoad: true,
    showEmptyState: true
  });
  
  public isRefreshing: WritableSignal<boolean> = signal(false);
  public isLoading: WritableSignal<boolean> = signal(false);
  public loadingMessage: WritableSignal<string> = signal('Loading...');
  
  // ================================
  // COMPUTED SIGNALS
  // ================================
  
  public activeSearches = computed(() => 
    this.searchOrchestrator.activeSearches()
  );
  
  public strategyStats = computed(() => 
    this.strategyManager.getStrategyStats()
  );
  
  public hasSearchResults = computed(() => 
    this.activeSearches().length > 0
  );
  
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
      label: 'Batch Process',
      query: 'BATCH001',
      icon: 'pi pi-th-large'
    },
    {
      type: 'natural',
      label: 'Smart Search',
      query: 'payment errors last hour',
      icon: 'pi pi-comments'
    }
  ];
  
  // ================================
  // LIFECYCLE & EFFECTS
  // ================================
  
  constructor() {
    // Effect to handle route data and mode changes
    effect(() => {
      const routeData = this.route.snapshot.data;
      const mode = routeData['mode'] || 'search';
      
      this.pageState.update(state => ({
        ...state,
        mode: mode as 'search' | 'browse' | 'error'
      }));
      
      // Initialize based on mode
      this.initializeMode(mode);
    });
    
    // Effect to sync page state with active searches
    effect(() => {
      const searches = this.activeSearches();
      const hasActiveSearches = searches.length > 0;
      
      this.pageState.update(state => ({
        ...state,
        hasActiveSearches,
        showEmptyState: !hasActiveSearches && state.isInitialLoad
      }));
    });
    
    // Effect to handle search bar positioning
    effect(() => {
      const hasResults = this.hasSearchResults();
      const searchBarComponent = this.searchBar();
      
      if (searchBarComponent) {
        searchBarComponent.setPosition(hasResults ? 'top' : 'center');
      }
    });
  }
  
  // ================================
  // INITIALIZATION METHODS
  // ================================
  
  private initializeMode(mode: string): void {
    switch (mode) {
      case 'browse':
        this.initializeBrowseMode();
        break;
      case 'error':
        this.initializeErrorMode();
        break;
      case 'search':
      default:
        this.initializeSearchMode();
        break;
    }
  }
  
  private initializeSearchMode(): void {
    console.log('[SearchLogs] Initialized in search mode');
    this.pageState.update(state => ({
      ...state,
      isInitialLoad: false
    }));
  }
  
  private initializeBrowseMode(): void {
    console.log('[SearchLogs] Initialized in browse mode');
    this.loadingMessage.set('Loading browse data...');
    this.isLoading.set(true);
    
    // Simulate browse mode initialization
    setTimeout(() => {
      this.isLoading.set(false);
      this.pageState.update(state => ({
        ...state,
        isInitialLoad: false
      }));
    }, 2000);
  }
  
  private initializeErrorMode(): void {
    console.log('[SearchLogs] Initialized in error mode');
    this.loadingMessage.set('Loading error stream...');
    this.isLoading.set(true);
    
    // Simulate error mode initialization
    setTimeout(() => {
      this.isLoading.set(false);
      this.pageState.update(state => ({
        ...state,
        isInitialLoad: false
      }));
    }, 2000);
  }
  
  // ================================
  // EVENT HANDLERS
  // ================================
  
  public async handleSearch(query: string): Promise<void> {
    console.log('[SearchLogs] Handling search:', query);
    
    this.loadingMessage.set(`Searching for: ${query.substring(0, 30)}...`);
    this.isLoading.set(true);
    
    try {
      // Use the orchestrator to perform the search
      await this.searchOrchestrator.performSearch({
        type: 'transaction', // Will be auto-detected by strategy manager
        query,
        title: '',
        appName: ''
      });
      
      // Update page state
      this.pageState.update(state => ({
        ...state,
        isInitialLoad: false,
        showEmptyState: false
      }));
      
    } catch (error) {
      console.error('[SearchLogs] Search failed:', error);
      // Handle error state
    } finally {
      this.isLoading.set(false);
    }
  }
  
  public searchExample(exampleQuery: string): void {
    console.log('[SearchLogs] Using example:', exampleQuery);
    
    const searchBarComponent = this.searchBar();
    if (searchBarComponent) {
      searchBarComponent.searchQuery.set(exampleQuery);
      searchBarComponent.focusInput();
    }
  }
  
  public async refreshActiveSearches(): Promise<void> {
    this.isRefreshing.set(true);
    this.loadingMessage.set('Refreshing searches...');
    
    try {
      const searches = this.activeSearches();
      
      for (const search of searches) {
        await this.searchOrchestrator.fetchDataFor(search);
      }
      
    } catch (error) {
      console.error('[SearchLogs] Refresh failed:', error);
    } finally {
      this.isRefreshing.set(false);
    }
  }
  
  public clearAllSearches(): void {
    console.log('[SearchLogs] Clearing all searches');
    
    this.searchOrchestrator.clearAllSearches();
    
    // Reset search bar
    const searchBarComponent = this.searchBar();
    if (searchBarComponent) {
      searchBarComponent.clearSearch();
    }
    
    // Update page state
    this.pageState.update(state => ({
      ...state,
      hasActiveSearches: false,
      showEmptyState: true
    }));
  }
  
  // ================================
  // UI HELPER METHODS
  // ================================
  
  public getContainerClass(): string {
    const state = this.pageState();
    const classes = ['search-logs'];
    
    classes.push(`mode-${state.mode}`);
    
    if (state.hasActiveSearches) {
      classes.push('has-results');
    }
    
    if (state.isInitialLoad) {
      classes.push('initial-load');
    }
    
    if (state.showEmptyState) {
      classes.push('show-empty');
    }
    
    return classes.join(' ');
  }
  
  // ================================
  // PUBLIC API METHODS
  // ================================
  
  /**
   * Programmatically trigger a search
   */
  public triggerSearch(query: string): void {
    this.handleSearch(query);
  }
  
  /**
   * Get current page mode
   */
  public getCurrentMode(): string {
    return this.pageState().mode;
  }
  
  /**
   * Check if page has active searches
   */
  public hasActiveSearches(): boolean {
    return this.pageState().hasActiveSearches;
  }
}