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

  private queryDetectionService = inject(SearchQueryDetectionService);

  // State signals
  public searchQuery: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);

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

  /**
   * Handle search input changes
   */
  public onInputChange(value: string): void {
    this.searchQuery.set(value);
  }

  /**
   * Execute the search
   */
  public executeSearch(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.isSearching.set(true);
    
    // Emit the search event
    this.search.emit(query);
    
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
   * Get search button tooltip
   */
  public getSearchTooltip(): string {
    const result = this.detectionResult();
    if (!result) return 'Enter a search query';
    
    const confidence = Math.round(result.confidence * 100);
    const type = this.queryDetectionService.getQueryTypeDescription(result);
    
    return `Search ${type} (${confidence}% confidence)`;
  }

  /**
   * Get detection description for hint
   */
  public getDetectionDescription(): string {
    const result = this.detectionResult();
    if (!result) return '';
    
    const confidence = Math.round(result.confidence * 100);
    const type = this.queryDetectionService.getQueryTypeDescription(result);
    
    return `Detected: ${type} (${confidence}% confidence)`;
  }

  /**
   * Get detection icon based on type
   */
  public getDetectionIcon(): string {
    const result = this.detectionResult();
    if (!result) return 'pi pi-search';
    
    switch (result.type) {
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      case 'natural': return 'pi pi-comment';
      default: return 'pi pi-search';
    }
  }

  /**
   * Get confidence level for styling
   */
  public getConfidenceLevel(): string {
    const result = this.detectionResult();
    if (!result) return 'low';
    
    if (result.confidence >= 0.8) return 'high';
    if (result.confidence >= 0.6) return 'medium';
    return 'low';
  }
}