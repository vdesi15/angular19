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
    public drawerVisible = signal(false);

    @ViewChild('favoritesPopover') favoritesPopover!: Popover;
    @ViewChild('favoritesButton') favoritesButton!: ElementRef;

    private navigationService = inject(NavigationService);
    private searchHistoryService = inject(SearchHistoryService);
    private searchOrchestrator = inject(SearchOrchestratorService);
    private confirmationService = inject(ConfirmationService);
    private router = inject(Router);

    // Get your existing nav items from config
    public navItems = toSignal(this.navigationService.getNavItems());

    // Computed signals for favorites and recent searches
    public favoriteItems = this.searchHistoryService.favoriteDisplayItems;
    public recentItems = this.searchHistoryService.recentDisplayItems;
    public favoriteCount = computed(() => this.favoriteItems().length);

    /**
     * Toggle sidebar expanded/collapsed state
     */
    toggleSidebar(): void {
        this.drawerVisible.update(expanded => !expanded);
    }

    /**
     *  Show favorites popover with manual positioning
     */
    public showFavoritesPopover(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        // Calculate position manually to ensure it appears to the right
        const buttonRect = this.favoritesButton.nativeElement.getBoundingClientRect();
        const sidebarWidth = this.drawerVisible() ? 145 : 55;

        // Position the popover to the right of the sidebar
        setTimeout(() => {
            const popoverElement = document.querySelector('.favorites-popover-custom .p-popover') as HTMLElement;
            if (popoverElement) {
                popoverElement.style.position = 'fixed';
                popoverElement.style.left = `${sidebarWidth + 8}px`;
                popoverElement.style.top = '50%';
                popoverElement.style.transform = 'translateY(-50%)';
                popoverElement.style.zIndex = '10000';
            }
        }, 0);

        this.favoritesPopover.toggle(event);
    }

    /**
     * Execute a search from history/favorites
     */
    public executeSearch(item: SearchDisplayItem): void {
        const search = item.searchData;

        // Hide the popover first
        this.favoritesPopover.hide();

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
     * Toggle favorite status of a search
     */
    public toggleFavorite(searchId: string, event: Event): void {
        event.stopPropagation(); // Prevent executing the search
        this.searchHistoryService.toggleFavorite(searchId);
    }

    /**
     * Get icon for different search types
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
            return days === 1 ? '1 day ago' : `${days} days ago`;
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
     * Clear all recent searches with confirmation
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

    /**
     * Get computed signals for reactive updates
     */
    public get hasFavorites(): boolean {
        return this.favoriteItems().length > 0;
    }

    public get hasRecentSearches(): boolean {
        return this.recentItems().length > 0;
    }
}