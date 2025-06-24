// components/sidebar/sidebar.component.ts - Clean implementation
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

// PrimeNG Modules
import { DrawerModule } from 'primeng/drawer';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

// Services
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { SearchOrchestratorService } from 'src/app/features/search-logs/services/search-orchestrator.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    DrawerModule,
    TooltipModule,
    ButtonModule,
    BadgeModule,
    PopoverModule,
    DividerModule,
    ScrollPanelModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  public drawerVisible = signal(true); // Start expanded
  
  private searchHistoryService = inject(SearchHistoryService);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  // Computed signals for reactive data
  public favoriteItems = this.searchHistoryService.favoriteDisplayItems;
  public recentItems = this.searchHistoryService.recentDisplayItems;
  public favoriteCount = computed(() => this.favoriteItems().length);

  /**
   * Toggle sidebar expansion
   */
  toggleSidebar(): void {
    this.drawerVisible.update(expanded => !expanded);
  }

  /**
   * Execute a search from history/favorites
   */
  public executeSearch(item: any): void {
    const search = item.searchData;
    
    // Navigate to appropriate route
    this.navigateToSearchType(search.type);
    
    // Execute the search after navigation
    setTimeout(() => {
      this.searchOrchestrator.executeSearchFromHistory(search);
    }, 100);
  }

  /**
   * Navigate to the correct route based on search type
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
   * Check if a search is favorited
   */
  public isFavorite(searchId: string): boolean {
    return this.searchHistoryService.isFavorite(searchId);
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(searchId: string, event: Event): void {
    event.stopPropagation(); // Prevent executing the search
    this.searchHistoryService.toggleFavorite(searchId);
  }

  /**
   * Get icon for search type
   */
  public getSearchIcon(type: string): string {
    switch (type) {
      case 'browse': return 'pi pi-list';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      case 'natural': return 'pi pi-comment';
      default: return 'pi pi-search';
    }
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
      return `${minutes}m ago`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than 1 week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    
    // More than 1 week - show actual date
    return timestamp.toLocaleDateString();
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
   * Clear search history with confirmation
   */
  public clearHistory(event: Event): void {
    event.stopPropagation();
    
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear search history?',
      header: 'Clear History',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.searchHistoryService.clearRecentSearches();
      }
    });
  }
}