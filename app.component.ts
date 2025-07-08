// src/app/app.component.ts - UPDATED TO PREVENT WHITE FLASH
import { Component, inject, OnInit, effect } from '@angular/core';
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
        <div class="app-loading">
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
      background: var(--splash-bg, var(--surface-ground, #ffffff));
      color: var(--text-color, #1d1d1f);
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .app-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--splash-bg, var(--surface-ground, #ffffff));
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
      color: var(--splash-text-secondary, var(--text-color-secondary, #86868b));
      margin: 0 0 32px 0;
      font-weight: 400;
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

  constructor() {
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

  private processUserData(user: any): void {
    console.log('[AppComponent] Processing user data for application setup');
  }
}