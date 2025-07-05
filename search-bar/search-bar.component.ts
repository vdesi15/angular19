// components/search-bar/search-bar.component.ts
import { Component, EventEmitter, Output, inject, signal, computed, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    ButtonModule
  ]
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();
  
  // View child for search input
  private searchInput = viewChild.required<ElementRef>('searchInput');
  
  // Service injections
  private searchOrchestrator = inject(SearchOrchestratorService);

  // JIRA Dialog States
  public showJiraUploadDialog: WritableSignal<boolean> = signal(false);
  public showTestCycleDialog: WritableSignal<boolean> = signal(false);
  public currentTestCycleId: WritableSignal<string> = signal('');

  // ================================
  // REACTIVE STATE SIGNALS
  // ================================

  public searchTerm: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);
  
  // Search bar state management
  public searchBarState: WritableSignal<SearchBarState> = signal({
    position: 'center',
    hasResults: false,
    isSearching: false
  });

  // ================================
  // COMPUTED SIGNALS
  // ================================

  public detectionResult = computed(() => {
    const query = this.searchTerm();
    if (!query.trim()) return null;
    return this.jiraService.detectJiraId(query);
  });

  public isValidQuery = computed(() => {
    const result = this.detectionResult();
    return result ? result.isValid : true;
  });

  public isTestCycle = computed(() => {
    const result = this.detectionResult();
    return result?.isValid && result.type === 'test-cycle';
  });

  public canSearch = computed(() => {
    const term = this.searchTerm().trim();
    return term.length > 0 && !this.isSearching();
  });

  // ================================
  // LIFECYCLE & EFFECTS - THIS IS THE KEY!
  // ================================

  constructor() {
    // MAIN EFFECT: Handle search bar positioning based on results
    effect(() => {
      const activeSearches = this.searchOrchestrator.activeSearches();
      const hasResults = activeSearches.length > 0;
      const currentState = this.searchBarState();
      
      console.log(`[SearchBar] Active searches: ${activeSearches.length}, hasResults: ${hasResults}`);
      
      // Auto-transition to top when results appear
      if (hasResults && currentState.position === 'center') {
        console.log('[SearchBar] Moving to top position');
        this.searchBarState.set({
          ...currentState,
          position: 'top',
          hasResults: true
        });
      }
      
      // Optional: Return to center when no results
      else if (!hasResults && currentState.position === 'top') {
        console.log('[SearchBar] Moving to center position');
        this.searchBarState.set({
          ...currentState,
          position: 'center',
          hasResults: false
        });
      }
    });

    // Effect to sync searching state from orchestrator
    effect(() => {
      const orchestratorSearching = this.searchOrchestrator.activeSearches()
        .some(search => search.isLoading);
      
      this.isSearching.set(orchestratorSearching);
      
      this.searchBarState.update(state => ({
        ...state,
        isSearching: orchestratorSearching
      }));
    });
  }

  // ================================
  // EVENT HANDLERS
  // ================================

 // ================================
  // MAIN SEARCH HANDLER - ENHANCED
  // ================================

  public async performSearch(): Promise<void> {
    const query = this.searchQuery();
    if (!query.trim()) return;

    this.isSearching.set(true);

    try {
      const detectionResult = this.detectionResult();
      
      // Handle test cycle specially - show dialog in search mode
      if (detectionResult?.isValid && detectionResult.type === 'test-cycle') {
        await this.handleTestCycleSearch(detectionResult.id);
        return;
      }

      // Handle other search types normally
      await this.handleRegularSearch(query);
      
    } catch (error) {
      console.error('[SearchBar] Search failed:', error);
    } finally {
      this.isSearching.set(false);
    }
  }

  /**
   * Handle test cycle search - show JIRA dialog in search mode
   */
  private async handleTestCycleSearch(testCycleId: string): Promise<void> {
    console.log(`[SearchBar] Handling test cycle search: ${testCycleId}`);
    
    this.jiraService.setPendingJiraId(term, 'search');
    // Set the JIRA input and show dialog in search mode
    this.showJiraUploadDialog.set(true);
    // The effect in the JIRA component will auto-load executions
    
    this.isSearching.set(false);
  }

  /**
   * Handle regular search (non-test-cycle)
   */
  private async handleRegularSearch(query: string): Promise<void> {
    console.log(`[SearchBar] Handling regular search: ${query}`);
    
    // Emit to parent (search-logs component) which will handle strategy detection
    this.search.emit(query.trim());
  }

  // ================================
  // JIRA DIALOG HANDLERS
  // ================================

  /**
   * Handle search request from JIRA dialog
   */
  public onJiraSearchRequested(event: { query: string; type: 'cycle' | 'execution' }): void {
    console.log('[SearchBar] JIRA search requested:', event);
    
    // Emit the search to parent component
    this.search.emit(event.query);
    
    // Close dialog
    this.showJiraUploadDialog.set(false);
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
    this.searchTerm.set('');
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

  /**
   * Set search term programmatically (for URL handling)
   */
  public setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }
}