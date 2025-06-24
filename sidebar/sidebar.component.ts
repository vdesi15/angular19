import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

// PrimeNG Modules for UI polish
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';

// App Services and Models
import { NavigationService } from '../../services/navigation.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TooltipModule,
    SkeletonModule,
    ButtonModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  public drawerVisible = signal(false); // Keep your original state
  
  private navigationService = inject(NavigationService);
  private searchHistoryService = inject(SearchHistoryService);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  // Get your existing nav items from config
  public navItems = toSignal(this.navigationService.getNavItems());
  
  // Computed signals for favorites
  public favoriteItems = this.searchHistoryService.favoriteDisplayItems;
  public recentItems = this.searchHistoryService.recentDisplayItems;
  public favoriteCount = computed(() => this.favoriteItems().length);

  /**
   * Keep your existing toggle function
   */
  toggleSidebar(): void {
    this.drawerVisible.update(expanded => !expanded);
  }

  /**
   * Execute a search from history/favorites
   */
  public executeSearch(item: any): void {
    const search = item.searchData;
    
    // Navigate to appropriate route using your routing structure
    this.navigateToSearchType(search.type);
    
    // Execute the search after navigation
    setTimeout(() => {
      this.searchOrchestrator.executeSearchFromHistory(search);
    }, 100);
  }

  /**
   * Navigate using your route structure
   */
  private navigateToSearchType(type: string): void {
    switch (type) {
      case 'browse':
        this.router.navigate(['/logs/browse']);
        break;
      case 'error':
        this.router.navigate(['/logs/errors']);
        break;
      case 'transaction':
      case 'jira':
      case 'batch':
      case 'natural':
      default:
        this.router.navigate(['/logs/search']);
        break;
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
    event.stopPropagation();
    this.searchHistoryService.toggleFavorite(searchId);
  }

  /**
   * Get icon for search type
   */
  public getSearchIcon(type: string): string {
    switch (type) {
      case 'browse': return 'fa fa-database';
      case 'error': return 'fa fa-bug';
      case 'transaction': 
      case 'jira':
      case 'batch':
      case 'natural':
      default: return 'fa fa-search';
    }
  }

  /**
   * Format timestamp for display
   */
  public formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    const days = Math.floor(diff / 86400000);
    return days < 7 ? `${days}d ago` : timestamp.toLocaleDateString();
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