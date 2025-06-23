import { Component, EventEmitter, Output, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// PrimeNG Modules
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { ChipModule } from 'primeng/chip';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { OverlayPanel } from 'primeng/overlaypanel';

// Services and Models
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
    BadgeModule,
    ChipModule,
    OverlayPanelModule,
    FavoritesPopoverComponent
  ],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();

  private queryDetectionService = inject(SearchQueryDetectionService);
  private router = inject(Router);

  // State signals
  public searchQuery: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);
  public showDetectionHint: WritableSignal<boolean> = signal(false);

  // Computed signals
  public detectionResult = computed(() => {
    const query = this.searchQuery();
    if (!query.trim()) return null;
    return this.queryDetectionService.detectQueryType(query);
  });

  public isValidQuery = computed(() => {
    const result = this.detectionResult();
    return result ? this.queryDetectionService.isValidDetection(result) : false;
  });

  public queryTypeDisplay = computed(() => {
    const result = this.detectionResult();
    if (!result) return '';
    return this.queryDetectionService.getQueryTypeDescription(result);
  });

  public searchPlaceholder = computed(() => {
    return this.getContextualPlaceholder();
  });

  public searchButtonIcon = computed(() => {
    const result = this.detectionResult();
    if (!result) return 'pi pi-search';
    
    switch (result.type) {
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      case 'natural': return 'pi pi-comment';
      default: return 'pi pi-search';
    }
  });

  public confidenceLevel = computed(() => {
    const result = this.detectionResult();
    return result ? Math.round(result.confidence * 100) : 0;
  });

  public confidenceColor = computed(() => {
    const confidence = this.confidenceLevel();
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'danger';
  });

  // Example search suggestions
  public readonly searchExamples = [
    {
      type: 'Transaction ID',
      examples: [
        '550e8400-e29b-41d4-a716-446655440000',
        'abc123def456ghi789jkl012mno345pqr',
        'trace_abc123def456'
      ],
      icon: 'pi pi-sitemap'
    },
    {
      type: 'JIRA Ticket',
      examples: [
        'PROJ-123',
        'TICKET-456',
        'BUG-789'
      ],
      icon: 'pi pi-ticket'
    },
    {
      type: 'Batch ID',
      examples: [
        'ABC123',
        'BATCH45',
        'XYZ789'
      ],
      icon: 'pi pi-clone'
    },
    {
      type: 'Natural Language',
      examples: [
        'show me errors from the last hour',
        'find transactions for user john.doe',
        'list all failed payments today'
      ],
      icon: 'pi pi-comment'
    }
  ];

  /**
   * Handle search input changes
   */
  public onInputChange(value: string): void {
    this.searchQuery.set(value);
    
    // Show detection hint for queries longer than 3 characters
    this.showDetectionHint.set(value.length > 3);
  }

  /**
   * Execute the search
   */
  public executeSearch(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    const result = this.detectionResult();
    if (!result || !this.queryDetectionService.isValidDetection(result)) {
      // Could show an error message or proceed anyway
      console.warn('Low confidence in query detection, proceeding anyway');
    }

    this.isSearching.set(true);
    
    // Emit the search event
    this.search.emit(query);
    
    // Add to browser history
    this.addToSearchHistory(query);
    
    // Reset searching state after a brief delay
    setTimeout(() => {
      this.isSearching.set(false);
    }, 1000);
  }

  /**
   * Handle Enter key press
   */
  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.executeSearch();
    }
  }

  /**
   * Clear the search input
   */
  public clearSearch(): void {
    this.searchQuery.set('');
    this.showDetectionHint.set(false);
  }

  /**
   * Use an example search query
   */
  public useExample(example: string, overlayPanel: OverlayPanel): void {
    this.searchQuery.set(example);
    this.showDetectionHint.set(true);
    overlayPanel.hide();
    
    // Focus the input field
    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="search"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 100);
  }

  /**
   * Navigate to browse mode
   */
  public navigateToBrowse(): void {
    this.router.navigate(['/browse']);
  }

  /**
   * Navigate to errors mode
   */
  public navigateToErrors(): void {
    this.router.navigate(['/errors']);
  }

  /**
   * Get contextual placeholder text
   */
  private getContextualPlaceholder(): string {
    const currentRoute = this.router.url;
    
    if (currentRoute.includes('/search')) {
      return 'Enter transaction ID, JIRA ticket, batch ID, or ask in natural language...';
    }
    
    return 'Search transactions, tickets, batches...';
  }

  /**
   * Add search to browser history for autocomplete
   */
  private addToSearchHistory(query: string): void {
    try {
      const searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      
      // Remove existing entry if present
      const filteredHistory = searchHistory.filter((item: string) => item !== query);
      
      // Add to beginning and limit to 10 items
      const updatedHistory = [query, ...filteredHistory].slice(0, 10);
      
      localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * Get search history for autocomplete
   */
  public getSearchHistory(): string[] {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }
}