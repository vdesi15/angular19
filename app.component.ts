// src/app/app.component.ts - Independent theme detection for loading state
import { Component, inject, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app-container" [class.app-dark]="themeService.isDarkMode()">
      <!-- Show loading until auth is ready -->
      @if (authService.isLoading()) {
        <div class="app-loading" [class.dark-loading]="isInitialDarkMode()">
          <div class="loading-content">
            <h1 class="loading-title">SEAL</h1>
            <div class="loading-message">Loading application...</div>
            <div class="loading-spinner"></div>
          </div>
        </div>
      } @else {
        <!-- App content when auth is ready -->
        <router-outlet></router-outlet>
      }
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: var(--surface-ground, #ffffff);
      color: var(--text-color, #1d1d1f);
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .app-container.app-dark {
      background: var(--surface-ground, #121212);
      color: var(--text-color, #ffffff);
    }

    .app-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #ffffff; /* Default light */
    }

    /* Dark loading state - matches splash screen */
    .app-loading.dark-loading {
      background: #1d1d1f;
    }

    .loading-content {
      text-align: center;
      max-width: 300px;
    }

    .loading-title {
      font-size: 2.5rem;
      font-weight: 600;
      color: #0171c5;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
    }

    .loading-message {
      font-size: 1rem;
      color: #86868b; /* Default light */
      margin: 0 0 32px 0;
      font-weight: 400;
    }

    /* Dark loading text */
    .app-loading.dark-loading .loading-message {
      color: #a1a1a6;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid transparent;
      border-top: 2px solid #0171c5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .loading-title {
        font-size: 2rem;
      }
      
      .loading-message {
        font-size: 0.9rem;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .loading-spinner {
        animation: none;
        opacity: 0.6;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  public readonly authService = inject(AuthService);
  public readonly themeService = inject(ThemeService);
  
  // Signal to track initial dark mode state (before ThemeService loads)
  private readonly _isInitialDarkMode = signal(false);
  
  constructor() {
    // Detect initial theme state for loading screen
    this.detectInitialTheme();
    
    // Effect to log user data when available
    effect(() => {
      const user = this.authService.userInfo();
      const isAuthenticated = this.authService.isAuthenticated();
      
      if (isAuthenticated && user) {
        console.log('[AppComponent] User authenticated and data available:', {
          name: user.name,
          email: user.email,
          groups: user.groups,
        });
        
        this.processUserData(user);
      }
    });
  }

  ngOnInit(): void {
    console.log('[AppComponent] Application starting...');
  }

  private detectInitialTheme(): void {
    try {
      const savedTheme = localStorage.getItem('app-theme-mode');
      // Match the same logic as your splash screen
      if (savedTheme === 'dark' || !savedTheme) {
        this._isInitialDarkMode.set(true);
      }
    } catch (error) {
      console.warn('[AppComponent] Could not detect initial theme:', error);
    }
  }

  public isInitialDarkMode(): boolean {
    return this._isInitialDarkMode();
  }

  private processUserData(user: any): void {
    console.log('[AppComponent] Processing user data for application setup');
  }
}