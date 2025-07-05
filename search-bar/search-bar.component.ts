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

  public onSearchSubmit(event: Event): void {
    event.preventDefault();
    
    const term = this.searchTerm().trim();
    if (!term || this.isSearching()) return;

    console.log('[SearchBar] Submitting search:', term);
    
    // Emit the search event
    this.search.emit(term);
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