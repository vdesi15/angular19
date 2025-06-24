// src/app/app.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostAuthRedirectService } from './core/services/post-auth-redirect.service';
import { SearchFilterService } from './core/services/filters.service';
import { ThemeService } from './core/services/theme.service';
import { LoadingService } from './core/services/loading.service';

/**
 * Enhanced App Component using Angular 19 features.
 * 
 * Key improvements:
 * - Initialize post-auth redirect handling
 * - Reactive theme management
 * - Better loading state management
 * - Improved error handling
 * - Signal-based state management
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app-container" [class.app-dark]="isDarkMode()">
      <!-- Global Loading Indicator -->
      <div *ngIf="isGlobalLoading()" class="global-loading">
        <div class="loading-spinner"></div>
        <p>{{ loadingMessage() }}</p>
      </div>

      <!-- Main Application -->
      <div class="app-content" [class.loading]="isGlobalLoading()">
        <router-outlet></router-outlet>
      </div>

      <!-- Global Error Display -->
      <div *ngIf="globalError()" class="global-error">
        <p>{{ globalError() }}</p>
        <button (click)="clearGlobalError()">Dismiss</button>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      position: relative;
      transition: background-color 0.3s ease;
    }

    .app-content {
      min-height: 100vh;
      transition: opacity 0.3s ease;
    }

    .app-content.loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .global-loading {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      color: white;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .global-error {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      max-width: 400px;
    }

    .global-error button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      margin-top: 8px;
      cursor: pointer;
    }

    .global-error button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Dark mode styles */
    .app-dark {
      background-color: #1a1a1a;
      color: #ffffff;
    }

    .app-dark .app-content {
      background-color: #1a1a1a;
    }
  `]
})
export class AppComponent implements OnInit {
  private readonly postAuthRedirectService = inject(PostAuthRedirectService);
  private readonly searchFilterService = inject(SearchFilterService);
  private readonly themeService = inject(ThemeService);
  private readonly loadingService = inject(LoadingService);
  private readonly router = inject(Router);

  // ================================
  // REACTIVE STATE SIGNALS
  // ================================

  // Theme state
  public readonly isDarkMode = this.themeService.isDarkMode;

  // Loading state
  public readonly isGlobalLoading = this.loadingService.isLoading;
  public readonly loadingMessage = this.loadingService.loadingMessage;

  // Error state
  private readonly _globalError = signal<string | null>(null);
  public readonly globalError = this._globalError.asReadonly();

  // Navigation state
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => event as NavigationEnd)
    )
  );

  // Computed signals for application state
  public readonly currentRoute = computed(() => {
    const nav = this.navigationEnd();
    return nav?.url || '/';
  });

  public readonly isAuthenticatedRoute = computed(() => {
    const route = this.currentRoute();
    return !route.includes('/auth') && !route.includes('/login');
  });

  // ================================
  // LIFECYCLE METHODS
  // ================================

  constructor() {
    console.log('[AppComponent] Initializing application');
    
    // Initialize global error handling
    this.setupGlobalErrorHandling();
    
    // Set up theme initialization
    this.initializeTheme();
  }

  ngOnInit(): void {
    console.log('[AppComponent] Component initialized');
    
    // The PostAuthRedirectService is automatically initialized via DI
    // but we can add any additional initialization logic here
    
    this.logApplicationState();
  }

  // ================================
  // PUBLIC METHODS
  // ================================

  public clearGlobalError(): void {
    this._globalError.set(null);
  }

  public setGlobalError(message: string): void {
    console.error('[AppComponent] Global error:', message);
    this._globalError.set(message);
  }

  public toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // ================================
  // DEBUG/DEVELOPMENT METHODS
  // ================================

  public getApplicationState(): any {
    return {
      currentRoute: this.currentRoute(),
      isDarkMode: this.isDarkMode(),
      isLoading: this.isGlobalLoading(),
      hasFilters: this.searchFilterService.hasFilters(),
      filterSummary: this.searchFilterService.filterSummary(),
      globalError: this.globalError()
    };
  }

  public resetApplication(): void {
    console.log('[AppComponent] Resetting application state');
    
    // Clear global error
    this.clearGlobalError();
    
    // Reset filter service
    this.searchFilterService.resetFilters();
    
    // Reset post-auth redirect state
    this.postAuthRedirectService.resetRedirectState();
    
    // Navigate to home
    this.router.navigate(['/logs/search']);
  }

  // ================================
  // PRIVATE IMPLEMENTATION
  // ================================

  private setupGlobalErrorHandling(): void {
    // Set up global error handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[AppComponent] Unhandled promise rejection:', event.reason);
      this.setGlobalError('An unexpected error occurred. Please try again.');
    });

    window.addEventListener('error', (event) => {
      console.error('[AppComponent] Global error:', event.error);
      this.setGlobalError('An unexpected error occurred. Please try again.');
    });
  }

  private initializeTheme(): void {
    // Theme service handles its own initialization
    console.log('[AppComponent] Theme initialized:', {
      isDarkMode: this.isDarkMode()
    });
  }

  private logApplicationState(): void {
    if (typeof window !== 'undefined' && window.console) {
      console.log('[AppComponent] Application state:', this.getApplicationState());
    }
  }
}