// src/app/app.component.ts - SIMPLE VERSION
import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app-container" [class.app-dark]="isDarkMode">
      <!-- Show loading until auth is ready -->
      @if (authService.isLoading()) {
        <div class="app-loading">
          <div class="loading-spinner"></div>
          <p>Loading application...</p>
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
      background: var(--surface-ground, #f8f9fa);
      color: var(--text-color, #212529);
    }

    .app-container.app-dark {
      background: var(--surface-ground, #121212);
      color: var(--text-color, #ffffff);
    }

    .app-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 1rem;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--surface-300, #e1e5e9);
      border-top: 4px solid var(--primary-color, #0171c5);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .app-loading p {
      color: var(--text-color-secondary, #6c757d);
      font-size: 1rem;
    }
  `]
})
export class AppComponent implements OnInit {
  public readonly authService = inject(AuthService);
  public isDarkMode = document.documentElement.classList.contains('app-dark');

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
          // Add any other user properties you need
        });
        
        // Now you can filter/process user data as needed
        this.processUserData(user);
      }
    });
  }

  ngOnInit(): void {
    console.log('[AppComponent] Application starting...');
    // Auth service auto-initializes, we just wait for it
  }

  private processUserData(user: any): void {
    // Your user data processing logic here
    console.log('[AppComponent] Processing user data for application setup');
    
    // Example: Set user-specific configurations
    // Example: Initialize user-specific services
    // Example: Set up user preferences
  }
}