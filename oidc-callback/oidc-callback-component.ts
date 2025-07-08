import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container" [class.app-dark]="isDarkMode">
      <div class="callback-content">
        <div class="loading-spinner"></div>
        <h2>Completing Sign In...</h2>
        <p>Please wait while we complete your authentication.</p>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--surface-ground, #f8f9fa);
      transition: background-color 0.3s ease;
    }

    .callback-container.app-dark {
      background: var(--surface-ground, #121212);
    }

    .callback-content {
      text-align: center;
      padding: 2rem;
      background: var(--surface-card, white);
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
      border: 1px solid var(--surface-border, #e1e5e9);
    }

    .app-dark .callback-content {
      background: var(--surface-card, #1e1e1e);
      border-color: var(--surface-border, #374151);
    }

    .callback-content h2 {
      color: var(--text-color, #212529);
      margin-bottom: 1rem;
    }

    .callback-content p {
      color: var(--text-color-secondary, #6c757d);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--surface-300, #e1e5e9);
      border-top: 4px solid var(--primary-color, #0171c5);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
   // Check dark mode for styling purposes
  public isDarkMode = document.documentElement.classList.contains('app-dark');

  ngOnInit(): void {
    // NO LOGIC NEEDED HERE.
    // The root-provided AuthService already started its `initializeAuth` process
    // automatically when the application loaded on this callback route.
    console.log('[OidcCallback] Component initialized. AuthService is handling the authentication process.');
}