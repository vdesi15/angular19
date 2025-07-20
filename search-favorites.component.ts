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
   @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

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

  // Modal controls
  public closeModal(): void {
    this.visibleChange.emit(false);
  }

  // Search actions
  public executeSearch(item: SearchDisplayItem): void {
    this.closeModal();
    this.navigateToSearchType(item.searchData.type);
    setTimeout(() => {
      this.searchOrchestrator.executeSearchFromHistory(item.searchData);
    }, 100);
  }

  private navigateToSearchType(type: string): void {
    switch (type) {
      case 'browse':
        this.router.navigate(['/logs/browse']);
        break;
      case 'error':
        this.router.navigate(['/logs/errors']);
        break;
      default:
        this.router.navigate(['/logs/search']);
        break;
    }
  }

  public isFavorite(searchId: string): boolean {
    return this.searchHistoryService.isFavorite(searchId);
  }

  public toggleFavorite(searchId: string, event: Event): void {
    event.stopPropagation();
    this.searchHistoryService.toggleFavorite(searchId);
  }

  public clearFavorites(event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: 'Clear all favorites?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.searchHistoryService.clearFavorites()
    });
  }

  public clearRecent(event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: 'Clear recent searches?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.searchHistoryService.clearRecentSearches()
    });
  }

  public getSearchIcon(type: string): string {
    switch (type) {
      case 'browse': return 'pi pi-search';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'transaction': return 'pi pi-receipt';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-list';
      default: return 'pi pi-search';
    }
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