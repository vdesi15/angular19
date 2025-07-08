// src/app/auth/oidc-callback/oidc-callback.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

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
        <div *ngIf="errorMessage" class="error-message">
          <p>{{ errorMessage }}</p>
          <button (click)="retryAuth()">Try Again</button>
        </div>
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

    .error-message {
      margin-top: 1rem;
      padding: 1rem;
      background: var(--red-50, #fef2f2);
      border: 1px solid var(--red-200, #fecaca);
      border-radius: 4px;
      color: var(--red-800, #991b1b);
    }

    .app-dark .error-message {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--red-300, #fca5a5);
    }

    button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: var(--primary-color, #0171c5);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    button:hover {
      background: var(--primary-color-dark, #0056b3);
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public errorMessage: string | null = null;
  public isDarkMode = document.documentElement.classList.contains('app-dark');

  ngOnInit(): void {
    console.log('[OidcCallback] Processing OIDC callback');
    this.processCallback();
  }

  private async processCallback(): Promise<void> {
    try {
      // Get current URL parameters for debugging
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('[OidcCallback] URL params:', { 
        hasCode: !!code, 
        hasState: !!state, 
        error,
        fullUrl: window.location.href
      });

      // Check for OAuth error first
      if (error) {
        const errorDesc = urlParams.get('error_description') || 'Authentication failed';
        throw new Error(`OAuth Error: ${error} - ${errorDesc}`);
      }

      // WORKAROUND: Handle the state parameter issue with angular-auth-oidc-client
      if (code && state) {
        console.log('[OidcCallback] Code and state present, attempting manual state validation bypass');
        
        // Try to process with a small delay to let the library settle
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Process the callback with retry logic for state issues
      const result = await this.processCallbackWithRetry();
      
      console.log('[OidcCallback] Auth result:', {
        isAuthenticated: result?.isAuthenticated,
        hasAccessToken: !!result?.accessToken,
        errorMessage: result?.errorMessage
      });

      if (result?.isAuthenticated) {
        console.log('[OidcCallback] Authentication successful');
        await this.handleSuccessfulAuth();
      } else {
        // Handle known state validation errors
        if (result?.errorMessage?.toLowerCase().includes('state')) {
          console.warn('[OidcCallback] State validation failed - attempting recovery');
          await this.handleStateValidationError(code, state);
        } else {
          throw new Error(result?.errorMessage || 'Authentication verification failed');
        }
      }

    } catch (error) {
      console.error('[OidcCallback] Authentication error:', error);
      
      // Check if it's a state-related error
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      if (errorMessage.toLowerCase().includes('state')) {
        this.errorMessage = 'Session expired or browser tab conflict. Please try signing in again.';
      } else {
        this.errorMessage = errorMessage;
      }
      
      // Auto redirect to default after error timeout
      setTimeout(() => this.fallbackRedirect(), 5000);
    }
  }

  /**
   * Process callback with retry logic for state validation issues
   */
  private async processCallbackWithRetry(maxRetries: number = 2): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[OidcCallback] Auth check attempt ${attempt}/${maxRetries}`);
        const result = await this.oidcSecurityService.checkAuth().toPromise();
        
        // If we get a result (success or clear error), return it
        if (result?.isAuthenticated || result?.errorMessage) {
          return result;
        }
        
        // If no clear result and we have retries left, wait and try again
        if (attempt < maxRetries) {
          console.log('[OidcCallback] Unclear result, retrying after delay...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return result;
        
      } catch (error) {
        console.warn(`[OidcCallback] Auth check attempt ${attempt} failed:`, error);
        
        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  /**
   * Handle state validation errors - common issue with tab switching
   */
  private async handleStateValidationError(code: string | null, state: string | null): Promise<void> {
    console.log('[OidcCallback] Handling state validation error');
    
    // Clear any stored state that might be corrupted
    try {
      // Clear OIDC storage (this helps with the tab switching issue)
      sessionStorage.removeItem('oidc.silent.redirect');
      sessionStorage.removeItem('oidc.redirect');
      
      // Clear any state-related items (adjust keys based on your OIDC lib version)
      const storageKeys = Object.keys(sessionStorage);
      storageKeys.forEach(key => {
        if (key.includes('oidc') && (key.includes('state') || key.includes('nonce'))) {
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('[OidcCallback] Cleared potentially corrupted OIDC storage');
      
    } catch (storageError) {
      console.warn('[OidcCallback] Failed to clear storage:', storageError);
    }
    
    // If we have a code, we can try to restart the auth flow
    if (code) {
      console.log('[OidcCallback] Code present but state invalid - redirecting to restart auth');
      this.errorMessage = 'Restarting authentication due to session conflict...';
      
      // Give user feedback then restart
      setTimeout(() => {
        this.oidcSecurityService.authorize();
      }, 2000);
    } else {
      throw new Error('State validation failed and no authorization code present');
    }
  }

  private async handleSuccessfulAuth(): Promise<void> {
    // Preserve URL parameters from before auth
    const savedUrl = sessionStorage.getItem('pre_auth_url');
    
    if (savedUrl && !this.isCallbackUrl(savedUrl)) {
      console.log('[OidcCallback] Redirecting to saved URL with params:', savedUrl);
      sessionStorage.removeItem('pre_auth_url');
      
      try {
        // Use navigateByUrl to preserve all params and fragments
        const success = await this.router.navigateByUrl(savedUrl);
        if (!success) {
          console.warn('[OidcCallback] Failed to navigate to saved URL');
          this.router.navigate(['/logs/search']);
        }
      } catch (error) {
        console.error('[OidcCallback] Navigation error:', error);
        this.router.navigate(['/logs/search']);
      }
    } else {
      console.log('[OidcCallback] No saved URL, using default');
      this.router.navigate(['/logs/search']);
    }
  }

  private fallbackRedirect(): void {
    console.log('[OidcCallback] Performing fallback redirect');
    sessionStorage.removeItem('pre_auth_url');
    this.router.navigate(['/logs/search']);
  }

  public retryAuth(): void {
    console.log('[OidcCallback] Retrying authentication');
    this.errorMessage = null;
    this.oidcSecurityService.authorize();
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('signin-oidc') || 
           url.includes('auth/callback') || 
           url.includes('code=');
  }
}