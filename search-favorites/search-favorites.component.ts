// src/app/core/components/search-favorites/search-favorites.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// PrimeNG Modules
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

// Services and Models
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { SearchOrchestratorService } from 'src/app/features/search-logs/services/search-orchestrator.service';
import { SearchDisplayItem } from 'src/app/core/models/search-history.model';

@Component({
  selector: 'app-favorites-popover',
  standalone: true,
  imports: [
    CommonModule, PopoverModule, ButtonModule, TooltipModule, 
    DividerModule, ScrollPanelModule, ConfirmDialogModule
  ],
  providers: [ConfirmationService]
})
export class FavoritesPopoverComponent {
  private searchHistoryService = inject(SearchHistoryService);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  // Reactive data from service
  public favoriteItems = this.searchHistoryService.favoriteDisplayItems;
  public recentItems = this.searchHistoryService.recentDisplayItems;

  // Computed helpers
  public hasFavorites = computed(() => this.favoriteItems().length > 0);
  public hasRecentSearches = computed(() => this.recentItems().length > 0);

  /**
   * Check if a search is favorited
   */
  public isFavorite(searchId: string): boolean {
    return this.searchHistoryService.isFavorite(searchId);
  }

  /**
   * Toggle favorite status of a search
   */
  public toggleFavorite(searchId: string, event: Event): void {
    event.stopPropagation(); // Prevent executing the search
    this.searchHistoryService.toggleFavorite(searchId);
  }

  /**
   * Execute a search from history
   */
  public executeSearch(item: SearchDisplayItem): void {
    const search = item.searchData;
    
    // Navigate to appropriate route based on search type
    this.navigateToSearchType(search.type);
    
    // Execute the search after navigation
    setTimeout(() => {
      this.searchOrchestrator.executeSearchFromHistory(search);
    }, 100);
  }

  /**
   * Navigate to the appropriate route based on search type
   */
  private navigateToSearchType(type: string): void {
    switch (type) {
      case 'browse':
        this.router.navigate(['/browse']);
        break;
      case 'error':
        this.router.navigate(['/errors']);
        break;
      case 'transaction':
      case 'jira':
      case 'batch':
      case 'natural':
        this.router.navigate(['/search']);
        break;
      default:
        this.router.navigate(['/search']);
    }
  }

  /**
   * Clear all favorites with confirmation
   */
  public clearFavorites(event: Event): void {
    event.stopPropagation();
    
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear all favorites?',
      header: 'Clear Favorites',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.searchHistoryService.clearFavorites();
      }
    });
  }

  /**
   * Clear all recent searches with confirmation
   */
  public clearRecent(event: Event): void {
    event.stopPropagation();
    
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear all recent searches?',
      header: 'Clear Recent Searches',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.searchHistoryService.clearRecentSearches();
      }
    });
  }

  /**
   * Format timestamp for display
   */
  public formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Less than 1 week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // More than 1 week - show actual date
    return timestamp.toLocaleDateString();
  }
}