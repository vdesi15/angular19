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
      const iss = urlParams.get('iss');
      const error = urlParams.get('error');

      console.log('[OidcCallback] OAuth callback parameters:', { 
        hasCode: !!code, 
        hasState: !!state,
        hasIss: !!iss,
        error,
        codeLength: code?.length,
        stateLength: state?.length
      });

      // Check for OAuth error first
      if (error) {
        const errorDesc = urlParams.get('error_description') || 'Authentication failed';
        throw new Error(`OAuth Error: ${error} - ${errorDesc}`);
      }

      // Validate we have the required OAuth parameters
      if (!code) {
        throw new Error('Missing authorization code in callback URL');
      }

      if (!state) {
        throw new Error('Missing state parameter in callback URL');
      }

      console.log('[OidcCallback] Valid OAuth callback detected, processing...');

      // Give the OIDC library a moment to process the URL
      await new Promise(resolve => setTimeout(resolve, 100));

      // Process the callback
      const result = await this.oidcSecurityService.checkAuth().toPromise();
      
      console.log('[OidcCallback] OIDC library result:', {
        isAuthenticated: result?.isAuthenticated,
        hasAccessToken: !!result?.accessToken,
        errorMessage: result?.errorMessage,
        configId: result?.configId
      });

      if (result?.isAuthenticated && result?.accessToken) {
        console.log('[OidcCallback] Authentication successful');
        await this.handleSuccessfulAuth();
      } else if (result?.errorMessage) {
        console.error('[OidcCallback] OIDC library error:', result.errorMessage);
        
        // Handle specific state validation errors
        if (result.errorMessage.toLowerCase().includes('state')) {
          throw new Error('Authentication state validation failed. This can happen if you switched browser tabs during login.');
        } else {
          throw new Error(result.errorMessage);
        }
      } else {
        throw new Error('Authentication completed but no access token received');
      }

    } catch (error) {
      console.error('[OidcCallback] Authentication processing failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.errorMessage = errorMessage;
      
      // Auto redirect after error (longer timeout for user to read message)
      setTimeout(() => this.fallbackRedirect(), 8000);
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
    console.log('[OidcCallback] Retrying authentication - clearing URL and starting fresh');
    this.errorMessage = null;
    
    // Clear the current URL to avoid callback loop
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Start fresh auth flow
    this.oidcSecurityService.authorize();
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('signin-oidc') || 
           url.includes('auth/callback') || 
           url.includes('code=');
  }
}