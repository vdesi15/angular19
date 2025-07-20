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

    // Services
    private navigationService = inject(NavigationService);
    private searchHistoryService = inject(SearchHistoryService);

    // Data
    public navItems = toSignal(this.navigationService.getNavItems());
    public favoriteCount = computed(() => this.searchHistoryService.favoriteDisplayItems().length);

    public toggleSidebar(): void {
        this.drawerVisible.update(expanded => !expanded);
    }
}