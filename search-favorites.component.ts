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
import { SearchDisplayItem } from 'src/app/core/models/saved-search.model';

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

  // Modal visibility
  public visible = signal(false);

  // Reactive data from service
  public favoriteItems = this.searchHistoryService.favoriteDisplayItems;
  public recentItems = this.searchHistoryService.recentDisplayItems;

  // Computed helpers
  public hasFavorites = computed(() => this.favoriteItems().length > 0);
  public hasRecentSearches = computed(() => this.recentItems().length > 0);
  public favoriteCount = computed(() => this.favoriteItems().length);

  // Modal controls
  public showModal(): void {
    this.visible.set(true);
  }

  public closeModal(): void {
    this.visible.set(false);
  }

  // Existing methods remain the same...
  public isFavorite(searchId: string): boolean {
    return this.searchHistoryService.isFavorite(searchId);
  }

  public toggleFavorite(searchId: string, event: Event): void {
    event.stopPropagation();
    this.searchHistoryService.toggleFavorite(searchId);
  }

  public executeSearch(item: SearchDisplayItem): void {
    this.closeModal(); // Close modal first
    this.searchOrchestrator.restoreSearchFromHistory(item.id);
  }

  public clearFavorites(event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear all favorites?',
      header: 'Clear Favorites',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.searchHistoryService.clearFavorites();
      }
    });
  }

  public clearRecent(event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear your recent search history?',
      header: 'Clear Recent Searches',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.searchHistoryService.clearRecentSearches();
      }
    });
  }

  public formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
}