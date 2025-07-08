// oidc-callback.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container" [class.app-dark]="isDarkMode">
      <div class="callback-content">
        <div class="loading-spinner" *ngIf="!hasError()"></div>
        <h2>{{ hasError() ? 'Authentication Error' : 'Completing Sign In...' }}</h2>
        <p>{{ message() }}</p>
        
        <button *ngIf="hasError()" 
                class="p-button p-button-primary"
                (click)="retryLogin()">
          Try Again
        </button>
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
      margin-bottom: 1.5rem;
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
    
    .p-button {
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    
    .p-button-primary {
      background: var(--primary-color, #0171c5);
      color: white;
    }
    
    .p-button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  public isDarkMode = document.documentElement.classList.contains('app-dark');
  public hasError = signal(false);
  public message = signal('Please wait while we complete your authentication.');
  
  private callbackTimeout?: number;

  ngOnInit(): void {
    console.log('[OidcCallback] Component initialized');
    
    // Set a timeout to detect if callback is taking too long
    this.callbackTimeout = window.setTimeout(() => {
      this.hasError.set(true);
      this.message.set('Authentication is taking longer than expected. Please try again.');
    }, 15000); // 15 second timeout
    
    // Process the callback
    this.processCallback();
  }
  
  ngOnDestroy(): void {
    if (this.callbackTimeout) {
      window.clearTimeout(this.callbackTimeout);
    }
  }
  
  private async processCallback(): Promise<void> {
    try {
      // Check for OAuth error in URL
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (error) {
        console.error('[OidcCallback] OAuth error:', error, errorDescription);
        this.hasError.set(true);
        this.message.set(errorDescription || 'Authentication failed. Please try again.');
        return;
      }
      
      // Call the auth service to handle the callback
      await this.authService.handleLoginCallback();
      
      // Clear timeout if successful
      if (this.callbackTimeout) {
        window.clearTimeout(this.callbackTimeout);
      }
      
    } catch (error) {
      console.error('[OidcCallback] Error processing callback:', error);
      this.hasError.set(true);
      this.message.set('An unexpected error occurred. Please try again.');
    }
  }
  
  public retryLogin(): void {
    // Clear any existing session data
    sessionStorage.clear();
    
    // Navigate back to the default page which will trigger login again
    this.router.navigate(['/logs/search']);
  }
}